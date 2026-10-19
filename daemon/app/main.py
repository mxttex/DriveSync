import os
import hashlib
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

DOCS_DIR = Path.home() / "Documents" / "DriveSyncDocs"
BASE_DIR = Path(__file__).resolve().parent.parent

env_docs_path = DOCS_DIR / ".env"
env_local_path = BASE_DIR / ".env"

if env_docs_path.exists():
    load_dotenv(dotenv_path=env_docs_path)
else:
    load_dotenv(dotenv_path=env_local_path)

app = FastAPI(title="DriveSync API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@dataclass
class Config:
    credentials_path: str
    token_path: str
    notes_folder: str
    drive_targeted_folder: str 

def resolve_file_path(env_val: str, filename: str) -> str:
    """
    Risolve il percorso assoluto cercando in ordine:
    1. Percorso assoluto fornito direttamente in .env
    2. Cartella ~/Documents/DriveSyncDocs/
    3. Cartella radice del daemon
    """
    if env_val and os.path.isabs(env_val) and os.path.exists(env_val):
        return env_val
    
    docs_candidate = DOCS_DIR / (env_val or filename)
    if docs_candidate.exists():
        return str(docs_candidate)
        
    base_candidate = BASE_DIR / (env_val or filename)
    if base_candidate.exists():
        return str(base_candidate)
        
    return str(docs_candidate)

def load_env_config() -> Config:
    credentials_val = os.getenv("CREDENTIALS", "credentials.json")
    token_val = os.getenv("TOKEN_PATH", "token.json")
    
    resolved_credentials = resolve_file_path(credentials_val, "credentials.json")
    resolved_token = resolve_file_path(token_val, "token.json")
    
    notes_folder = os.getenv("NOTES_FOLDER", "")
    if not notes_folder or not os.path.exists(notes_folder):
        notes_folder = str(DOCS_DIR)

    return Config(
        credentials_path=resolved_credentials,
        token_path=resolved_token,
        notes_folder=notes_folder,
        drive_targeted_folder=os.getenv("FOLDER_ID", "")
    )

def get_drive_service(config: Config):
    scopes = ['https://www.googleapis.com/auth/drive']
    creds = None

    if os.path.exists(config.token_path):
        creds = Credentials.from_authorized_user_file(config.token_path, scopes)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(config.credentials_path):
                raise FileNotFoundError(
                    f"Impossibile trovare 'credentials.json'. Cercato in: '{config.credentials_path}' e '{BASE_DIR / 'credentials.json'}'"
                )
            flow = InstalledAppFlow.from_client_secrets_file(config.credentials_path, scopes)
            creds = flow.run_local_server(port=0)

        os.makedirs(os.path.dirname(config.token_path), exist_ok=True)
        with open(config.token_path, 'w') as token_file:
            token_file.write(creds.to_json())
            
    return build('drive', 'v3', credentials=creds)

def fetch_local_pdfs(root_path: str) -> List[Dict[str, Any]]:
    pdf_list = []
    if root_path and os.path.exists(root_path):
        for actual_dir, _, file_list in os.walk(root_path):
            for file_name in file_list:
                if file_name.lower().endswith(".pdf"):
                    abs_path = os.path.join(actual_dir, file_name)
                    file_size = os.path.getsize(abs_path)
                    pdf_list.append({
                        "name": file_name,
                        "path": abs_path,
                        "size": f"{round(file_size / (1024 * 1024), 2)} MB"
                    })
    return pdf_list

def fetch_remote_files(service, folder_id: str) -> Dict[str, Dict[str, str]]:
    r_map = {}
    if folder_id:
        query_result = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields="files(id, name, md5Checksum)"
        ).execute()

        files = query_result.get('files', [])
        for file in files:
            name = file['name']
            r_map[name] = {
                'id': file['id'],
                'md5': file.get('md5Checksum', '')
            }
    return r_map

def calculate_md5(file_path: str) -> str:
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as file:
        for chunk in iter(lambda: file.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def sync_file_to_drive(service, local_path: str, folder_id: str = None, remote_id: str = None) -> str:
    file_name = os.path.basename(local_path)
    media = MediaFileUpload(local_path, mimetype='application/pdf')

    if remote_id:
        service.files().update(fileId=remote_id, media_body=media).execute()
        return f"{file_name} aggiornato con successo"
    elif folder_id:
        file_metadata = {'name': file_name, 'parents': [folder_id]}
        service.files().create(body=file_metadata, media_body=media).execute()
        return f"{file_name} caricato con successo"
    else:
        raise ValueError("Parametri mancanti per la sincronizzazione")


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/getLocalFiles")
def get_local_files():
    config = load_env_config()
    files = fetch_local_pdfs(config.notes_folder)
    return {"status": "success", "files": files}

@app.get("/getRemoteFiles")
def get_remote_files_endpoint():
    try:
        config = load_env_config()
        service = get_drive_service(config)
        remote_map = fetch_remote_files(service, config.drive_targeted_folder)
        
        files = [{"name": k, "id": v["id"], "md5": v["md5"]} for k, v in remote_map.items()]
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sync")
def sync_files():
    try:
        config = load_env_config()
        service = get_drive_service(config)
        
        local_pdfs = fetch_local_pdfs(config.notes_folder)
        remote_files = fetch_remote_files(service, config.drive_targeted_folder)
        
        logs = []
        
        for pdf in local_pdfs:
            file_path = pdf["path"]
            file_name = pdf["name"]
            
            if file_name not in remote_files:
                msg = sync_file_to_drive(service, file_path, folder_id=config.drive_targeted_folder)
                logs.append(msg)
            else:
                remote_info = remote_files[file_name]
                if calculate_md5(file_path) != remote_info['md5']:
                    msg = sync_file_to_drive(service, file_path, remote_id=remote_info['id'])
                    logs.append(msg)
                else:
                    logs.append(f"{file_name} è già aggiornato")
                    
        return {"status": "success", "logs": logs}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
import os
import hashlib
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from dataclasses import dataclass

@dataclass
class Config:
    credentials_path:str
    token_path:str
    notes_folder:str
    drive_targeted_folder:str 

#simple method that load the variables saved into the .env files into the dataclass
def load_env_config():
    load_dotenv()
    config = Config(
        credentials_path = os.getenv("CREDENTIALS"),
        token_path = os.getenv("TOKEN_PATH"),
        notes_folder = os.getenv("NOTES_FOLDER"),
        drive_targeted_folder = os.getenv("FOLDER_ID")
    )
    
    return config

#method that authenticate and configures the drive apis 
def get_drive_service(config):
    scopes = ['https://www.googleapis.com/auth/drive']
    creds = None

    if os.path.exists(config.token_path):
        creds = Credentials.from_authorized_user_file(config.token_path, scopes)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(config.credentials_path, scopes)
            creds = flow.run_local_server(port=0)


        with open(config.token_path, 'w') as token_file:
            token_file.write(creds.to_json())
    return build('drive', 'v3', credentials=creds)

def list_local_pdfs(root_path):
    pdf_list = []

    for actual_dir, other_dirs, file_list in os.walk(root_path):
        for file_name in file_list:
            if file_name.endswith(".pdf"):
                abs_path = actual_dir + "\\" + file_name
                pdf_list.append(abs_path)

    return pdf_list 

def get_remote_files(service, folder_id):
    r_map = {}

    query_result = service.files().list(
        q=f"'{folder_id}' in parents and trashed = false",
        fields="files(id, name, md5Checksum)"
    ).execute()

    files = query_result.get('files', [])

    for file in files:
        name = file['name']
        r_map[name] = {
            'id': file['id'],
            'md5': file.get('md5Checksum') 
        }
    return r_map

#necessary to understand if the file has been modified
def calculate_md5(file_path):
    hash_md5 = hashlib.md5()

    with open(file_path) as file:
        for chunk in file:
            hash_md5.update(chunk)

    return hash_md5.hexdigest()

def upload_on_drive(service, local_path, folder_id,):
    try:
        file_name = os.path.basename(local_path)
        pdf = MediaFileUpload(local_path, mimetype='application/pdf')
        file_metadata = {'name': file_name, 'parents': [folder_id]}

        service.files().create(body=file_metadata, media_body=pdf).execute()
        print(f"il file {file_name} e' stato caricato con successo")
    except Exception as error:
        print(f'errore: {error}')

def update_on_drive(service, local_path, file_id):
    try:
        file_name = os.path.basename(local_path)
        pdf = MediaFileUpload(local_path, mimetype='application/pdf')

        service.files().update(file_id=file_id, media_body=pdf).execute()
        print(f"il file {file_name} e' stato aggiornato con successo")
    except Exception as error:
        print(f'errore: {error}')
def main():
    config = load_env_config()
    drive_settings = get_drive_service(config)
    pdfs_paths = list_local_pdfs(config.notes_folder)
    files_already_on_drive = get_remote_files(drive_settings, config.drive_targeted_folder)
   
    for file in pdfs_paths:
        file_name = os.path.basename(file)
        if file_name not in files_already_on_drive:
            upload_on_drive(drive_settings, file, config.drive_targeted_folder)
        else:
            remote_info = files_already_on_drive[file_name]
            remote_md5 = remote_info['md5']
            remote_id = remote_info['id']
            if calculate_md5(file) != remote_md5:
                update_on_drive(drive_settings, file, remote_id)
            else:
                print(f"{file_name} è già aggiornato.")

          
            


if __name__ == "__main__":
    main()
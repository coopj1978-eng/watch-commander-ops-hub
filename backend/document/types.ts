export interface ProfileDocument {
  id: number;
  profile_id: number;
  uploader_user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_key: string;
  tags: string[];
  uploaded_at: Date;
}

export interface GetUploadUrlRequest {
  profile_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  tags?: string[];
}

export interface GetUploadUrlResponse {
  upload_url: string;
  document_id: number;
}

export interface ListDocumentsResponse {
  documents: ProfileDocument[];
}

export interface GetDownloadUrlResponse {
  download_url: string;
}

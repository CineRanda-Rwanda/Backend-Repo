/// <reference types="multer" />

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import config from '../../config';
import crypto from 'crypto';

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    const { region, accessKeyId, secretAccessKey, s3Bucket } = config.aws;

    // This safety check prevents the app from running with incomplete AWS config
    if (!region || !accessKeyId || !secretAccessKey || !s3Bucket) {
      throw new Error('AWS configuration is incomplete. Please check your .env file.');
    }

    this.s3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
    this.bucketName = s3Bucket;
    this.region = region;
  }

  /**
   * Uploads a file to the S3 bucket.
   * @param file The file object from Multer.
   * @param folder The folder within the bucket to upload to (e.g., 'posters', 'videos', 'subtitles').
   * @returns The public URL of the uploaded file.
   */
  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    // Generate a unique filename to prevent overwrites
    const uniqueFileName = `${folder}/${crypto.randomBytes(16).toString('hex')}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: uniqueFileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);

      // Construct the public URL of the uploaded file
      const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${uniqueFileName}`;
      
      return fileUrl;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file to S3.');
    }
  }

  /**
   * Deletes a file from the S3 bucket using its public URL.
   * @param fileUrl The full public URL of the file to delete.
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) {
      console.log('Skipping S3 delete: fileUrl is empty.');
      return;
    }

    try {
      const url = new URL(fileUrl);
      const keyFromPath = url.pathname.substring(1);

      // --- FIX: Decode the key to handle spaces and other special characters ---
      const decodedKey = decodeURIComponent(keyFromPath);

      if (!decodedKey) {
        throw new Error('Could not extract a valid key from the file URL.');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: decodedKey, // Use the decoded key
      });

      await this.s3Client.send(command);
      console.log(`Successfully deleted ${decodedKey} from S3.`);
    } catch (error) {
      console.error(`Failed to delete file from S3: ${fileUrl}`, error);
      
      // --- FIX: Check the type of 'error' before accessing its properties ---
      if (error instanceof Error) {
        throw new Error(`S3 Deletion Failed: ${error.message}`);
      } else {
        throw new Error(`S3 Deletion Failed: An unknown error occurred.`);
      }
    }
  }
}
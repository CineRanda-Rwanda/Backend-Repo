/// <reference types="multer" />

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

  // We will implement this later when we build the DELETE endpoint.
  // async deleteFile(fileUrl: string): Promise<void> { ... }
}
/// <reference types="multer" />

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

  /**
   * Generate a pre-signed URL for temporary access to private S3 objects
   * @param fileUrl The full S3 URL of the file
   * @param expiresIn Time in seconds until the URL expires (default: 2 hours)
   * @returns A signed URL that grants temporary access
   */
  async getSignedUrl(fileUrl: string, expiresIn: number = 7200): Promise<string> {
    try {
      // Handle empty or invalid URLs
      if (!fileUrl || typeof fileUrl !== 'string') {
        console.warn('Invalid fileUrl provided to getSignedUrl');
        return fileUrl;
      }

      // If URL doesn't contain s3 or amazonaws, return as-is (might be external)
      if (!fileUrl.includes('s3') && !fileUrl.includes('amazonaws')) {
        return fileUrl;
      }

      // Extract the key from the URL
      const url = new URL(fileUrl);
      const key = decodeURIComponent(url.pathname.substring(1)); // Remove leading '/'

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      // Return original URL as fallback
      return fileUrl;
    }
  }

  /**
   * Sign subtitle object URLs
   */
  async signSubtitles(subtitles: any, expiresIn: number = 86400): Promise<any> {
    if (!subtitles || typeof subtitles !== 'object') {
      return subtitles;
    }
    
    const signed: any = {};
    
    for (const [lang, url] of Object.entries(subtitles)) {
      if (typeof url === 'string' && url) {
        signed[lang] = await this.getSignedUrl(url, expiresIn);
      }
    }
    
    return Object.keys(signed).length > 0 ? signed : subtitles;
  }
}
// src/aws/s3.service.ts
import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName = process.env.AWS_S3_BUCKET_NAME;
  private cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION')!,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        )!,
      },
    });
  }

  async uploadFile(file: Express.Multer.File, key: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'max-age=31536000',
    });

    await this.s3Client.send(command);

    if (this.cloudFrontDomain) {
      return `https://${this.cloudFrontDomain}/${key}`;
    }

    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      console.error(`[S3] Failed to delete object: ${key}`, error);
      throw error; // rethrow so the caller can handle or report
    }
  }
  async deleteBookFolder(username: string, book: string): Promise<void> {
    const prefix = `books/${username}/${book}/`;

    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const listedObjects = await this.s3Client.send(listCommand);

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        return;
      }

      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key! })),
        },
      });

      await this.s3Client.send(deleteCommand);
    } catch (error) {
      console.error(`[S3] Failed to delete folder: ${prefix}`, error);
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async renameBookAssets(
    username: string,
    oldSlug: string,
    newSlug: string,
  ): Promise<void> {
    const bucket = this.bucketName;
    const oldPrefix = `books/${username}/${oldSlug}/`;
    const newPrefix = `books/${username}/${newSlug}/`;

    try {
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: oldPrefix,
        }),
      );

      const contents = listResponse.Contents ?? [];
      if (contents.length === 0) {
        return;
      }

      for (const obj of contents) {
        const oldKey = obj.Key!;
        const newKey = oldKey.replace(oldPrefix, newPrefix);

        // Copy to new key
        await this.s3Client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${oldKey}`,
            Key: newKey,
          }),
        );

        // Delete old key
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: oldKey,
          }),
        );
      }
    } catch (error) {
      console.error(`Error during S3 rename: ${error}`);
      throw new Error('Failed to rename book assets in S3');
    }
  }
}

// src/upload/upload.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Service } from '../aws/s3.service';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

type UploadResults = {
  coverUrl: string | null;
  bannerUrl: string | null;
};

@Injectable()
export class UploadService {
  constructor(private s3Service: S3Service) {}

  private async validateFile(
    file: Express.Multer.File,
    type: 'cover' | 'banner',
  ): Promise<void> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = type === 'cover' ? 2 * 1024 * 1024 : 5 * 1024 * 1024; // 2MB for cover, 5MB for banner

    // Define required dimensions
    const requiredDimensions = {
      cover: { width: 400, height: 600 },
      banner: { width: 1600, height: 600 },
    };

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type for ${type}. Only JPEG, PNG, and WebP are allowed.`,
      );
    }

    if (file.size > maxSize) {
      throw new BadRequestException(
        `${type} file too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`,
      );
    }

    // Validate image dimensions
    try {
      const metadata = await sharp(file.buffer).metadata();
      const { width, height } = metadata;
      const required = requiredDimensions[type];

      if (width !== required.width || height !== required.height) {
        throw new BadRequestException(
          `Invalid ${type} dimensions. Required: ${required.width}x${required.height}px, got: ${width}x${height}px`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid image file for ${type}. Unable to process image.`,
      );
    }
  }

  private getFileExtension(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension || 'jpg'; // fallback to jpg if no extension
  }

  async uploadBookAssets(
    author: string,
    title: string,
    cover?: Express.Multer.File,
    banner?: Express.Multer.File,
  ): Promise<UploadResults> {
    const results: UploadResults = {
      coverUrl: null,
      bannerUrl: null,
    };

    try {
      if (cover) {
        // Validate cover file
        await this.validateFile(cover, 'cover');

        const coverExtension = this.getFileExtension(cover.originalname);
        const coverKey = `books/${author}/${title}/cover-${uuidv4()}.${coverExtension}`;
        results.coverUrl = await this.s3Service.uploadFile(cover, coverKey);
      }

      if (banner) {
        // Validate banner file
        await this.validateFile(banner, 'banner');

        const bannerExtension = this.getFileExtension(banner.originalname);
        const bannerKey = `books/${author}/${title}/banner-${uuidv4()}.${bannerExtension}`;
        results.bannerUrl = await this.s3Service.uploadFile(banner, bannerKey);
      }

      return results;
    } catch (error) {
      // Clean up any uploaded files if one fails
      if (results.coverUrl) {
        const coverKey = this.extractKeyFromUrl(results.coverUrl);
        await this.s3Service.deleteFile(coverKey).catch(console.error);
      }

      throw error;
    }
  }

  private extractKeyFromUrl(url: string): string {
    // Extract the key from the S3 URL
    const urlParts = url.split('/');
    const bucketIndex = urlParts.findIndex((part) =>
      part.includes('amazonaws.com'),
    );
    return urlParts.slice(bucketIndex + 1).join('/');
  }

  async deleteBookAssets(coverUrl?: string, bannerUrl?: string): Promise<void> {
    const deletePromises: Promise<void>[] = [];

    if (coverUrl) {
      const coverKey = this.extractKeyFromUrl(coverUrl);
      deletePromises.push(this.s3Service.deleteFile(coverKey));
    }

    if (bannerUrl) {
      const bannerKey = this.extractKeyFromUrl(bannerUrl);
      deletePromises.push(this.s3Service.deleteFile(bannerKey));
    }

    await Promise.all(deletePromises);
  }

  async updateBookAssets(
    authorId: string,
    bookId: string,
    existingCoverUrl?: string,
    existingBannerUrl?: string,
    newCover?: Express.Multer.File,
    newBanner?: Express.Multer.File,
  ): Promise<UploadResults> {
    const results: UploadResults = {
      coverUrl: existingCoverUrl || null,
      bannerUrl: existingBannerUrl || null,
    };

    // Upload new cover if provided
    if (newCover) {
      await this.validateFile(newCover, 'cover');

      const coverExtension = this.getFileExtension(newCover.originalname);
      const coverKey = `books/${authorId}/${bookId}/cover-${uuidv4()}.${coverExtension}`;
      results.coverUrl = await this.s3Service.uploadFile(newCover, coverKey);

      // Delete old cover if it exists
      if (existingCoverUrl) {
        const oldCoverKey = this.extractKeyFromUrl(existingCoverUrl);
        await this.s3Service.deleteFile(oldCoverKey).catch(console.error);
      }
    }

    // Upload new banner if provided
    if (newBanner) {
      await this.validateFile(newBanner, 'banner');

      const bannerExtension = this.getFileExtension(newBanner.originalname);
      const bannerKey = `books/${authorId}/${bookId}/banner-${uuidv4()}.${bannerExtension}`;
      results.bannerUrl = await this.s3Service.uploadFile(newBanner, bannerKey);

      // Delete old banner if it exists
      if (existingBannerUrl) {
        const oldBannerKey = this.extractKeyFromUrl(existingBannerUrl);
        await this.s3Service.deleteFile(oldBannerKey).catch(console.error);
      }
    }

    return results;
  }
}

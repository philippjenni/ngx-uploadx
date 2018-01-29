import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';

import {
  UploadxOptions,
  UploadState,
  UploadxControlEvent,
  UploaderOptions
} from './interfaces';
import { Uploader } from './uploader';
/**
 *
 * @class UploadxService
 */
@Injectable()
export class UploadxService {
  subj: Subject<UploadState> = new Subject();
  private queue: Uploader[] = [];
  private concurrency = 2;
  private autoUpload = true;
  private options: UploadxOptions;

  get uploaderOptions(): UploaderOptions {
    return {
      method: this.options.method || 'POST',
      url: this.options.url || '/upload/',
      headers: this.options.headers,
      token: this.options.token,
      chunkSize: this.options.chunkSize || 0,
      withCredentials: this.options.withCredentials || false,
      subj: this.subj,
      nextFile: () => this.processQueue()
    };
  }
  /**
   * Set global module options
   */
  init(options: UploadxOptions): Observable<UploadState> {
    this.options = options;
    this.concurrency = options.concurrency || this.concurrency;
    this.autoUpload = options.autoUpload || false;
    return this.subj.asObservable();
  }
  /**
   *
   * Create Uploader and add to the queue
   */
  handleFileList(fileList: FileList) {
    for (let i = 0; i < fileList.length; i++) {
      const uploader: Uploader = new Uploader(
        fileList.item(i),
        this.uploaderOptions
      );
      this.queue.push(uploader);
    }
    if (this.autoUpload) {
      this.queue.forEach(upload => {
        upload.configure();
      });
      this.processQueue();
    }
  }
  /**
   * Control upload status
   * @example
   * this.uploadService.control({ action: 'pauseAll' });
   *
   */
  control(event: UploadxControlEvent) {
    switch (event.action) {
      case 'cancelAll':
        this.queue
          .filter(f => f.status !== 'complete')
          .map(f => (f.status = 'cancelled'));
        break;
      case 'pauseAll':
        this.queue
          .filter(f => f.status !== 'complete')
          .map(f => (f.status = 'paused'));
        break;
      case 'uploadAll':
        this.queue
          .filter(f => f.status !== 'complete' && f.status !== 'uploading')
          .map(f => (f.status = 'queue'));
        this.processQueue();
        break;
      case 'upload':
        const uploadId = event.uploadId || event.itemOptions.uploadId;
        const target = this.queue.find(f => f.uploadId === uploadId);
        target.configure(event.itemOptions);
        this.processQueue();
        break;
      case 'cancel':
        this.queue.find(f => f.uploadId === event.uploadId).status =
          'cancelled';
        break;
      case 'pause':
        this.queue.find(f => f.uploadId === event.uploadId).status = 'paused';
        break;
      default:
        break;
    }
  }
  /**
   * Queue management
   * @private
   */
  private processQueue() {
    const running = this.queue.filter(
      (uploader: Uploader) => uploader.status === 'uploading'
    );

    const complete = this.queue.findIndex(
      (uploader: Uploader) => uploader.status === 'complete'
    );
    if (complete !== -1) {
      this.queue.splice(complete, 1);
    }
    this.queue
      .filter((uploader: Uploader) => uploader.status === 'queue')
      .slice(0, this.concurrency - running.length)
      .forEach((uploader: Uploader) => {
        uploader.upload();
      });
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  WorkflowJobPayload,
  WorkflowJobResult,
  WorkflowJobStatus,
  QueueMetrics,
} from '@flowmind/contracts';
import { isValidWorkflowJobPayload } from '@flowmind/contracts';

interface JobEntry {
  payload: WorkflowJobPayload;
  status: WorkflowJobStatus;
  result?: WorkflowJobResult;
  error?: string;
  updatedAt: string;
}

@Injectable()
export class InMemoryJobQueue {
  private readonly queue: string[] = [];
  private readonly jobs = new Map<string, JobEntry>();
  private readonly idempotencyIndex = new Map<string, string>();

  async enqueue(job: WorkflowJobPayload): Promise<{ jobId: string; enqueued: boolean; isDuplicate: boolean }> {
    if (!isValidWorkflowJobPayload(job)) {
      throw new BadRequestException('Contrato de job inválido');
    }

    if (job.idempotencyKey) {
      const scopedKey = `${job.orgId}:${job.idempotencyKey}`;
      const existingJobId = this.idempotencyIndex.get(scopedKey);
      if (existingJobId) {
        return { jobId: existingJobId, enqueued: false, isDuplicate: true };
      }
    }

    const normalizedJob: WorkflowJobPayload = {
      ...job,
      attempt: job.attempt ?? 1,
      maxRetries: job.maxRetries ?? 3,
      enqueuedAt: job.enqueuedAt ?? new Date().toISOString(),
    };

    const entry: JobEntry = {
      payload: normalizedJob,
      status: 'PENDING',
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(normalizedJob.jobId, entry);
    this.queue.push(normalizedJob.jobId);

    if (normalizedJob.idempotencyKey) {
      this.idempotencyIndex.set(`${normalizedJob.orgId}:${normalizedJob.idempotencyKey}`, normalizedJob.jobId);
    }

    return { jobId: normalizedJob.jobId, enqueued: true, isDuplicate: false };
  }

  async dequeue(): Promise<WorkflowJobPayload | null> {
    const nextJobId = this.queue.shift();
    if (!nextJobId) {
      return null;
    }

    const entry = this.jobs.get(nextJobId);
    if (!entry) {
      return null;
    }

    entry.status = 'ACTIVE';
    entry.updatedAt = new Date().toISOString();
    return { ...entry.payload };
  }

  completeJob(jobId: string, result: WorkflowJobResult): void {
    const entry = this.jobs.get(jobId);
    if (!entry) return;

    entry.status = 'COMPLETED';
    entry.result = result;
    entry.updatedAt = new Date().toISOString();
  }

  failJob(jobId: string, error: string, retryable = false): { canRetry: boolean; nextAttempt: number } {
    const entry = this.jobs.get(jobId);
    if (!entry) {
      return { canRetry: false, nextAttempt: 0 };
    }

    const currentAttempt = entry.payload.attempt ?? 1;
    const maxRetries = entry.payload.maxRetries ?? 3;

    if (retryable && currentAttempt < maxRetries) {
      const nextAttempt = currentAttempt + 1;
      entry.payload.attempt = nextAttempt;
      entry.status = 'RETRYING';
      entry.error = error;
      entry.updatedAt = new Date().toISOString();
      this.queue.push(jobId);
      return { canRetry: true, nextAttempt };
    }

    entry.status = 'FAILED';
    entry.error = error;
    entry.updatedAt = new Date().toISOString();
    return { canRetry: false, nextAttempt: currentAttempt };
  }

  getJob(jobId: string): { payload: WorkflowJobPayload; status: WorkflowJobStatus; result?: WorkflowJobResult; error?: string } | null {
    const entry = this.jobs.get(jobId);
    if (!entry) return null;
    return {
      payload: { ...entry.payload },
      status: entry.status,
      result: entry.result ? { ...entry.result } : undefined,
      error: entry.error,
    };
  }

  getMetrics(): QueueMetrics {
    let pendingJobs = 0;
    let activeJobs = 0;
    let completedJobs = 0;
    let failedJobs = 0;

    for (const entry of this.jobs.values()) {
      switch (entry.status) {
        case 'PENDING':
        case 'RETRYING':
          pendingJobs++;
          break;
        case 'ACTIVE':
          activeJobs++;
          break;
        case 'COMPLETED':
          completedJobs++;
          break;
        case 'FAILED':
          failedJobs++;
          break;
      }
    }

    return {
      isAvailable: true,
      pendingJobs,
      activeJobs,
      completedJobs,
      failedJobs,
    };
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue.length = 0;
    this.jobs.clear();
    this.idempotencyIndex.clear();
  }
}

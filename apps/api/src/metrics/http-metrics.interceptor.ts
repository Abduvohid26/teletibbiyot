import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    return next.handle().pipe(
      tap({
        next: () => this.metrics.recordRequest(res.statusCode || 200),
        error: () => this.metrics.recordRequest(res.statusCode || 500),
      }),
    );
  }
}

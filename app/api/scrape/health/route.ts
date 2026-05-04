import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';

const BASE_URL = 'https://myschool.ng';

interface HealthCheck {
  status: 'ok' | 'error';
  httpStatus?: number;
  responseTime?: string;
  contentType?: string;
  dataSize?: string;
  containsLinks?: boolean;
  error?: string;
  code?: string;
  type?: string;
}

interface HealthResponse {
  timestamp: string;
  checks: {
    baseUrl: HealthCheck;
    classroom: HealthCheck;
    network: {
      nodeVersion: string;
      environment?: string;
      timeout: string;
    };
  };
}

export async function GET(req: NextRequest): Promise<NextResponse<HealthResponse>> {
  const results: HealthResponse = {
    timestamp: new Date().toISOString(),
    checks: {
      baseUrl: { status: 'ok' },
      classroom: { status: 'ok' },
      network: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV,
        timeout: process.env.AXIOS_TIMEOUT || '30000ms'
      }
    }
  };

  // Check if myschool.ng is reachable
  try {
    const startTime = Date.now();
    const { status, headers } = await axios.head(BASE_URL, {
      timeout: 10000,
      validateStatus: () => true
    });
    const responseTime = Date.now() - startTime;

    results.checks.baseUrl = {
      status: 'ok',
      httpStatus: status,
      responseTime: `${responseTime}ms`,
      contentType: headers['content-type']
    };
  } catch (err) {
    const error = err as Error & { code?: string };
    results.checks.baseUrl = {
      status: 'error',
      error: error?.message,
      code: error?.code
    };
  }

  // Check classroom page
  try {
    const startTime = Date.now();
    const { status, data, headers } = await axios.get<string>(`${BASE_URL}/classroom`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const responseTime = Date.now() - startTime;

    results.checks.classroom = {
      status: 'ok',
      httpStatus: status,
      responseTime: `${responseTime}ms`,
      dataSize: `${data.length} bytes`,
      containsLinks: /href=".*\/classroom\/[^"]+/.test(data)
    };
  } catch (err) {
    const error = err as Error & { code?: string };
    results.checks.classroom = {
      status: 'error',
      error: error?.message,
      code: error?.code,
      type: error?.constructor?.name
    };
  }

  return NextResponse.json(results);
}

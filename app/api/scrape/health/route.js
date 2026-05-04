import axios from 'axios';

const BASE_URL = 'https://myschool.ng';

export async function GET(req) {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {}
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
    results.checks.baseUrl = {
      status: 'error',
      error: err?.message,
      code: err?.code
    };
  }

  // Check classroom page
  try {
    const startTime = Date.now();
    const { status, data } = await axios.get(`${BASE_URL}/classroom`, {
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
    results.checks.classroom = {
      status: 'error',
      error: err?.message,
      code: err?.code,
      type: err?.constructor?.name
    };
  }

  // Check network connectivity
  results.checks.network = {
    nodeVersion: process.version,
    environment: process.env.NODE_ENV,
    timeout: process.env.AXIOS_TIMEOUT || '30000ms'
  };

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

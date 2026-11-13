import client from 'prom-client';

// Create a Registry which registers the metrics
export const register = new client.Registry();

// Add default system & node.js metrics (memory, CPU, event loop lag, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'pharmacy_'
});

// Custom HTTP request duration histogram
export const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'pharmacy_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

register.registerMetric(httpRequestDurationMicroseconds);

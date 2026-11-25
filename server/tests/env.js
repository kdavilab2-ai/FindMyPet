require('dotenv').config({ quiet: true });
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'findmypet-test-uploads');

// Copie le site compilé (dist/) à la racine du dépôt, servie par GitHub Pages.
import { cpSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(import.meta.dirname, '../dist');
if (existsSync(resolve(root, 'assets'))) rmSync(resolve(root, 'assets'), { recursive: true });
cpSync(resolve(dist, 'index.html'), resolve(root, 'index.html'));
cpSync(resolve(dist, 'assets'), resolve(root, 'assets'), { recursive: true });
console.log('Site copié à la racine du dépôt.');

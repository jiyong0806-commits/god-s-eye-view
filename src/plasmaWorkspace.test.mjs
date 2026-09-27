import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('map icon does not shadow the built-in Map used by icon roots', () => {
  const code = readFileSync(new URL('./plasmaWorkspace.js', import.meta.url), 'utf8');
  const imports = code.match(/import \{([^}]+)\} from 'lucide-react'/)[1];
  assert.ok(imports.includes('Map as MapIcon'));
  assert.ok(!imports.split(',').some(name => name.trim() === 'Map'));
  assert.match(code, /const roots = new Map\(\)/);
});
test('manual refresh uses bounded batches instead of all enabled layers at once', () => {
  const code = readFileSync(new URL('./plasmaControls.js', import.meta.url), 'utf8');
  assert.match(code, /activeIds\.slice\(i, i \+ 2\)/);
  assert.ok(!code.includes('Promise.allSettled(activeIds.map'));
});

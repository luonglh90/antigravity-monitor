import * as glob from 'glob';
import Mocha from 'mocha';
import * as path from 'path';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000,
  });

  const testsRoot = path.resolve(__dirname, './__tests__');

  return new Promise((c, e) => {
    const testFiles = glob.sync('**/**.test.js', { cwd: testsRoot });

    // Add files to the test suite
    testFiles.forEach(file => mocha.addFile(path.resolve(testsRoot, file)));

    try {
      // Run the mocha test
      mocha.run((failures: number) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    } catch (err) {
      console.error(err);
      e(err);
    }
  });
}

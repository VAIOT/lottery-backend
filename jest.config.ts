import { pathsToModuleNameMapper } from 'ts-jest'
import { compilerOptions } from './tsconfig.json'
import type { JestConfigWithTsJest } from 'ts-jest'
import dotenv from 'dotenv';

dotenv.config();
const jestConfig: JestConfigWithTsJest = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	coverageDirectory: "./coverage",
	rootDir: "./",
	roots: [
		"./test"
	],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
};

export default jestConfig
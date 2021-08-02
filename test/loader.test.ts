import webpack4 from 'webpack';
import webpack5 from 'webpack5';
import { MinifyPluginOptions } from '../src/interfaces';
import { build, getFile } from './utils';
import * as fixtures from './fixtures';

type WebpackSourceMapDevToolPlugin =
  | webpack4.SourceMapDevToolPlugin
  | webpack5.SourceMapDevToolPlugin;
type WebpackRuleSetRule = webpack4.RuleSetRule | webpack5.RuleSetRule;

describe.each([
	['Webpack 4', webpack4],
	['Webpack 5', webpack5],
])('%s', (_name, webpack) => {
	describe('Error handling', () => {
		test('tsx handled as ts', async () => {
			await expect(async () => {
				await build(webpack, fixtures.tsx, (config) => {
					config.module.rules.push({
						test: /\.tsx$/,
						loader: 'esbuild-loader',
						options: {
							loader: 'ts',
						},
					});
				});
			}).rejects.toThrow('Unexpected ">"');
		});

		test('invalid tsx', async () => {
			await expect(async () => {
				await build(webpack, fixtures.invalidTsx, (config) => {
					config.module.rules.push({
						test: /\.tsx?$/,
						loader: 'esbuild-loader',
						options: {
							loader: 'tsx',
						},
					});
				});
			}).rejects.toThrow('Unexpected "const"');
		});

		test('invalid implementation option', async () => {
			const runWithImplementation = async (implementation: MinifyPluginOptions['implementation']) => {
				await build(webpack, fixtures.tsx, (config) => {
					config.module.rules.push({
						test: /\.js?$/,
						loader: 'esbuild-loader',
						options: {
							implementation,
						},
					});
				});
			};

			// @ts-expect-error testing invalid type
			await expect(runWithImplementation({})).rejects.toThrow(
				'esbuild-loader: options.implementation.transform must be an ESBuild transform function. Received undefined',
			);

			// @ts-expect-error testing invalid type
			await expect(runWithImplementation({ transform: 123 })).rejects.toThrow(
				'esbuild-loader: options.implementation.transform must be an ESBuild transform function. Received number',
			);
		});
	});

	describe('Loader', () => {
		test('js', async () => {
			const stats = await build(webpack, fixtures.js);
			const file = getFile(stats, '/dist/index.js');

			expect(file.content).toMatchSnapshot();
			expect(file.execute()).toMatchSnapshot();
		});

		test('ts', async () => {
			const stats = await build(webpack, fixtures.ts, (config) => {
				config.module.rules.push({
					test: /\.ts$/,
					loader: 'esbuild-loader',
					options: {
						loader: 'ts',
					},
				});
			});
			const file = getFile(stats, '/dist/index.js');

			expect(file.content).toMatchSnapshot();
			expect(file.execute()).toMatchSnapshot();
		});

		test('tsx', async () => {
			const stats = await build(webpack, fixtures.tsx, (config) => {
				config.module.rules.push({
					test: /\.tsx$/,
					loader: 'esbuild-loader',
					options: {
						loader: 'tsx',
						jsxFactory: 'createElement',
						jsxFragment: 'Fragment',
					},
				});
			});
			const file = getFile(stats, '/dist/index.js');

			expect(file.content).toMatchSnapshot();
			expect(file.execute('const createElement = (...args) => args, Fragment = "Fragment";')).toMatchSnapshot();
		});

		test('ts w/ tsconfig', async () => {
			const stats = await build(webpack, fixtures.tsConfig, (config) => {
				config.module.rules.push({
					test: /\.ts$/,
					loader: 'esbuild-loader',
					options: {
						loader: 'ts',
					},
				});
			});
			const stats2 = await build(webpack, fixtures.tsConfig, (config) => {
				config.module.rules.push({
					test: /\.ts$/,
					loader: 'esbuild-loader',
					options: {
						loader: 'ts',
						tsconfigRaw: {
							compilerOptions: {
								useDefineForClassFields: true,
							},
						},
					},
				});
			});

			expect(getFile(stats, '/dist/index.js').content).not.toBe(getFile(stats2, '/dist/index.js').content);
			expect(getFile(stats2, '/dist/index.js').content).toMatchSnapshot();
		});

		test('tsx w/ tsconfig', async () => {
			const stats = await build(webpack, fixtures.tsx, (config) => {
				config.module.rules.push({
					test: /\.tsx$/,
					loader: 'esbuild-loader',
					options: {
						loader: 'tsx',
						tsconfigRaw: {
							compilerOptions: {
								jsxFactory: 'customFactory',
								jsxFragmentFactory: 'customFragment',
							},
						},
					},
				});
			});
			const file = getFile(stats, '/dist/index.js');

			expect(file.content).toMatchSnapshot();
			expect(file.execute('const customFactory = (...args) => args, customFragment = "Fragment";')).toMatchSnapshot();
		});

		test('custom esbuild transform function', async () => {
			const stats = await build(webpack, fixtures.ts, (config) => {
				config.module.rules.push({
					test: /\.tsx?$/,
					loader: 'esbuild-loader',
					options: {
						loader: 'tsx',
						implementation: {
							transform: async () => ({
								code: 'export function foo() { return "MY_CUSTOM_ESBUILD_IMPLEMENTATION"; }',
								map: '',
								warnings: [],
							}),
						},
					},
				});
			});

			const { content } = getFile(stats, '/dist/index.js');
			expect(content).toContain('MY_CUSTOM_ESBUILD_IMPLEMENTATION');
			expect(content).toMatchSnapshot();
		});

		describe('ambigious ts/tsx', () => {
			test('ts via tsx', async () => {
				const stats = await build(webpack, fixtures.ts, (config) => {
					config.module.rules.push({
						test: /\.tsx?$/,
						loader: 'esbuild-loader',
						options: {
							loader: 'tsx',
						},
					});
				});

				expect(getFile(stats, '/dist/index.js').content).toMatchSnapshot();
			});

			test('ts via tsx 2', async () => {
				const stats = await build(webpack, fixtures.ts2, (config) => {
					config.module.rules.push({
						test: /\.tsx?$/,
						loader: 'esbuild-loader',
						options: {
							loader: 'tsx',
						},
					});
				});
				const file = getFile(stats, '/dist/index.js');

				expect(file.content).toMatchSnapshot();
				expect(file.execute().default('a', { a: 1 })).toMatchSnapshot();
			});

			test('ambiguous ts', async () => {
				const stats = await build(webpack, fixtures.tsAmbiguous, (config) => {
					config.module.rules.push({
						test: /\.tsx?$/,
						loader: 'esbuild-loader',
						options: {
							loader: 'tsx',
						},
					});
				});

				const { content } = getFile(stats, '/dist/index.js');
				expect(content).toContain('(() => 1 < /a>/g)');
				expect(content).toMatchSnapshot();
			});

			test('ambiguous tsx', async () => {
				const stats = await build(webpack, fixtures.tsxAmbiguous, (config) => {
					config.module.rules.push({
						test: /\.tsx?$/,
						loader: 'esbuild-loader',
						options: {
							loader: 'tsx',
						},
					});
				});

				const { content } = getFile(stats, '/dist/index.js');
				expect(content).toContain('React.createElement');
				expect(content).toMatchSnapshot();
			});
		});
	});

	// Targets
	test('target', async () => {
		const stats = await build(webpack, fixtures.js, (config) => {
			(config.module.rules as WebpackRuleSetRule[])[0].options = {
				target: 'es2015',
			};
		});
		const file = getFile(stats, '/dist/index.js');

		expect(file.content).toMatchSnapshot();
		expect(file.execute()).toMatchSnapshot();
	});

	describe('Source-map', () => {
		test('source-map eval', async () => {
			const stats = await build(webpack, fixtures.js, (config) => {
				config.devtool = 'eval-source-map';
			});
			const file = getFile(stats, '/dist/index.js');

			expect(file.content).toMatchSnapshot();
			expect(file.content).toContain('eval');
		});

		test('source-map inline', async () => {
			const stats = await build(webpack, fixtures.js, (config) => {
				config.devtool = 'inline-source-map';
			});
			const file = getFile(stats, '/dist/index.js');

			expect(file.content).toMatchSnapshot();
			expect(file.content).toContain('sourceMappingURL');
		});

		test('source-map file', async () => {
			const stats = await build(webpack, fixtures.js, (config) => {
				config.devtool = 'source-map';
			});

			expect(getFile(stats, '/dist/index.js').content).toMatchSnapshot();
			expect(getFile(stats, '/dist/index.js.map').content).toMatchSnapshot();
		});

		test('source-map plugin', async () => {
			const stats = await build(webpack, fixtures.js, (config) => {
				delete config.devtool;
				(config.plugins as WebpackSourceMapDevToolPlugin[]).push(
					new webpack.SourceMapDevToolPlugin({}),
				);
			});
			const file = getFile(stats, '/dist/index.js');

			expect(file.content).toMatchSnapshot();
			expect(file.content).toContain('sourceMappingURL');
		});
	});

	test('webpack magic comments', async () => {
		const stats = await build(webpack, fixtures.webpackChunks);

		const { assets } = stats.compilation;
		expect(getFile(stats, '/dist/index.js').content).toMatchSnapshot();
		expect(assets).toHaveProperty(['named-chunk-foo.js']);
		expect(getFile(stats, '/dist/named-chunk-foo.js').content).toMatchSnapshot();
		expect(assets).toHaveProperty(['named-chunk-bar.js']);
		expect(getFile(stats, '/dist/named-chunk-bar.js').content).toMatchSnapshot();
	});
});

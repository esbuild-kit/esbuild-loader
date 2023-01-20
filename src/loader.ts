import { transform as defaultEsbuildTransform } from 'esbuild';
import { getOptions } from 'loader-utils';
import webpack from 'webpack';
import type { LoaderOptions } from './types';
import { tsconfig } from './tsconfig';

async function ESBuildLoader(
	this: webpack.loader.LoaderContext,
	source: string,
): Promise<void> {
	const done = this.async()!;
	const options: LoaderOptions = getOptions(this);
	const {
		implementation,
		...esbuildTransformOptions
	} = options;

	if (implementation && typeof implementation.transform !== 'function') {
		done(
			new TypeError(
				`esbuild-loader: options.implementation.transform must be an ESBuild transform function. Received ${typeof implementation.transform}`,
			),
		);
		return;
	}

	const transform = implementation?.transform ?? defaultEsbuildTransform;

	const transformOptions = {
		...esbuildTransformOptions,
		target: options.target ?? 'es2015',
		loader: options.loader ?? 'default',
		sourcemap: this.sourceMap,
		sourcefile: this.resourcePath,
	};

	if (!('tsconfigRaw' in transformOptions)) {
		transformOptions.tsconfigRaw = tsconfig;
	}

	try {
		const { code, map } = await transform(source, transformOptions);
		done(null, code, map && JSON.parse(map));
	} catch (error: unknown) {
		done(error as Error);
	}
}

export default ESBuildLoader;

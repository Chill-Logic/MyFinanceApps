
import { IPath } from '@/types';

import { AuthPaths } from './auth';
import { DefaultPaths } from './default';

export const Paths: IPath[] = [
	...DefaultPaths,
	...AuthPaths
];

export const getNavigationPaths = (): Omit<IPath, 'element' | 'template'>[] => {
	return Paths.filter(path => path?.isMainPath).map(({ id, path, display }) => ({ id, path, display }));
};
  
(() => {
	const paths_ids_hash: { [key: string]: boolean } = {};
	Paths.forEach((path) => {
		if (paths_ids_hash[path.id]) {
			throw new Error(`O id ${ path.id } para a rota ${ path.path } já foi utilizado. Utilize um id único para cada rota.`);
		}
		paths_ids_hash[path.id] = true;
	});
})();
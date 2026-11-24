import { useEffect, useState } from 'react';

export const useMediaQuery = (query: string) => {
	const [ matches, setMatches ] = useState(() => window.matchMedia(query).matches);

	useEffect(() => {
		const media_query_list = window.matchMedia(query);
		const listener = () => setMatches(media_query_list.matches);

		listener();
		media_query_list.addEventListener('change', listener);
		return () => media_query_list.removeEventListener('change', listener);
	}, [ query ]);

	return matches;
};

export default useMediaQuery;

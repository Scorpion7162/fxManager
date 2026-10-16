import { useNuiEvent } from '~/hooks/useNuiEvent';
import { useMenuStore } from '~/store/menustore';

/**
 * Used to listen for client SCRT updates for the various states
 * to keep'em updated when the UI is closed
 */

export function useMenuSync() {
	const { setNoclip, setTags, setBlips } = useMenuStore();

	useNuiEvent<{ key: 'no-clip' | 'tags' | 'blips'; state: boolean }>(
		'menustore-update',
		({ key, state }) => {
			switch (key) {
				case 'blips':
					setBlips(state);
					break;
				case 'no-clip':
					setNoclip(state);
					break;
				case 'tags':
					setTags(state);
					break;
			}
		},
	);
}

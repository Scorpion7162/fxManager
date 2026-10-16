import { useCallback, useEffect } from 'react';
import { useMenuStore } from '~/store/menustore';
import { isEnvBrowser } from '~/utils/misc';

interface UseRovingFocusOptions {
	itemCount: number;
	groups: string[];
	disabled?: boolean;
	onActivate?: (index: number) => void;
}

export function useRovingFocus({
	itemCount,
	groups,
	disabled = false,
	onActivate,
}: UseRovingFocusOptions) {
	// index -1 = Category Header Bar, 0 to itemCount - 1 = Action items
	const [activeGroup, activeIndex] = useMenuStore((state) => state.item);
	const setItem = useMenuStore((state) => state.setItem);

	// Fallback to the first group if the stored group becomes invalid
	const currentGroup = groups.includes(activeGroup)
		? activeGroup
		: groups[0] || '';

	const moveDown = useCallback(() => {
		const next = activeIndex < itemCount - 1 ? activeIndex + 1 : 0;
		setItem(currentGroup, next);
	}, [activeIndex, itemCount, currentGroup, setItem]);

	const moveUp = useCallback(() => {
		const prev = activeIndex >= 0 ? activeIndex - 1 : itemCount - 1;
		setItem(currentGroup, prev);
	}, [activeIndex, itemCount, currentGroup, setItem]);

	const moveLeft = useCallback(() => {
		if (activeIndex === -1 && groups.length > 0) {
			const currentIndex = groups.indexOf(currentGroup);
			const prevIndex = (currentIndex - 1 + groups.length) % groups.length;
			setItem(groups[prevIndex]!, 0);
		}
	}, [activeIndex, currentGroup, groups, setItem]);

	const moveRight = useCallback(() => {
		if (activeIndex === -1 && groups.length > 0) {
			const currentIndex = groups.indexOf(currentGroup);
			const nextIndex = (currentIndex + 1) % groups.length;
			setItem(groups[nextIndex]!, 0);
		}
	}, [activeIndex, currentGroup, groups, setItem]);

	const activateCurrent = useCallback(() => {
		if (activeIndex >= 0) {
			onActivate?.(activeIndex);
		} else if (activeIndex === -1) {
			// Pressing Enter/Select on header drops focus to item 0
			setItem(currentGroup, 0);
		}
	}, [activeIndex, currentGroup, onActivate, setItem]);

	// Dev-only fallback keyboard listener when testing in standard web browser
	useEffect(() => {
		if (!isEnvBrowser()) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (disabled) return;

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					moveDown();
					break;
				case 'ArrowUp':
					e.preventDefault();
					moveUp();
					break;
				case 'ArrowLeft':
					e.preventDefault();
					moveLeft();
					break;
				case 'ArrowRight':
					e.preventDefault();
					moveRight();
					break;
				case 'Enter':
				case ' ':
					e.preventDefault();
					activateCurrent();
					break;
				case 'Tab':
					e.preventDefault();
					setItem(currentGroup, -1);
					break;
				default:
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		moveDown,
		moveUp,
		moveLeft,
		moveRight,
		activateCurrent,
		currentGroup,
		setItem,
		disabled,
	]);

	return {
		activeGroup: currentGroup,
		activeIndex,
		moveDown,
		moveUp,
		moveLeft,
		moveRight,
		activateCurrent,
		resetFocus: () => setItem(currentGroup, -1),
	};
}

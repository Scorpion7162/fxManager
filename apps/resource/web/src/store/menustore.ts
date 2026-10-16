import { create } from 'zustand';

interface MenuState {
	noclip: boolean;
	tags: boolean;
	blips: boolean;
	setNoclip: (noclip: boolean) => void;
	setTags: (tags: boolean) => void;
	setBlips: (blips: boolean) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
	noclip: false,
	tags: true,
	blips: false,
	setNoclip: (noclip) => set({ noclip }),
	setTags: (tags) => set({ tags }),
	setBlips: (blips) => set({ blips }),
}));

const SAFE_85 =
	" !#$%&'()+,-.0123456789;=@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{}";
const SAFE_83 =
	"!#$%&'()+,-0123456789;=@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{}";
const REGENERATE_MARKER = '☭';

function generateId(str: string): string {
	let h1 = 0xde_ad_be_ef | 0,
		h2 = 0x41_c6_ce_57 | 0;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2_654_435_761);
		h2 = Math.imul(h2 ^ ch, 1_597_334_677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909);
	let hash = 4_294_967_296 * (2_097_151 & h2) + (h1 >>> 0);
	const c4 = hash % 83;
	hash = Math.trunc(hash / 83);
	const c3 = hash % 85;
	hash = Math.trunc(hash / 85);
	const c2 = hash % 85;
	hash = Math.trunc(hash / 85);
	const c1 = hash % 85;
	hash = (hash / 85) | 0;
	const c0 = hash % 85;
	return SAFE_85[c0] + SAFE_85[c1] + SAFE_85[c2] + SAFE_85[c3] + SAFE_83[c4];
}
export default function generateAnchor(source: string, existing: Set<string>) {
	let anchor: string;
	do {
		anchor = generateId(source);
		if (!existing.has(anchor)) break;
		source += REGENERATE_MARKER;
	} while (true);
	return anchor;
}

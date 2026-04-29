export function parseXML(xml: string): never {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'application/xml');

	// Handle parse errors
	const errorNode = doc.querySelector('parsererror');
	if (errorNode) throw new Error(`XML Parse Error: ${errorNode.textContent?.trim()}`);

	const convertNode = (node: Node): unknown => {
		if (node.nodeType !== Node.ELEMENT_NODE) return null;

		const elem = node as Element;
		const result: Record<string, unknown> = {};
		let textContent = '';
		const elementChildren: Element[] = [];

		// attributeNamePrefix: '' & removeNSPrefix: true
		// Using `localName` automatically strips namespace prefixes
		for (let i = 0; i < elem.attributes.length; i++) {
			const attr = elem.attributes[i];
			result[attr.localName] = attr.value;
		}

		// Collect text and child elements
		for (const child of elem.childNodes) {
			if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
				textContent += child.nodeValue || '';
			} else if (child.nodeType === Node.ELEMENT_NODE) {
				elementChildren.push(child as Element);
			}
		}
		textContent = textContent.trim();

		// Group children by tag name
		const grouped: Record<string, unknown[]> = {};
		for (const child of elementChildren) {
			const name = child.localName; // removeNSPrefix: true
			if (!grouped[name]) grouped[name] = [];
			grouped[name].push(convertNode(child));
		}

		const hasAttributes = elem.attributes.length > 0;
		const hasChildren = Object.keys(grouped).length > 0;

		// parseTagValue: false -> keep everything as strings
		// If only text and no attributes/children, return plain string
		if (!hasAttributes && !hasChildren && textContent) {
			return textContent;
		}

		// If mixed content or attributes exist, store text under `#text`
		if (textContent) {
			result['#text'] = textContent;
		}

		// Flatten single-child arrays to match fast-xml-parser behavior
		for (const [name, children] of Object.entries(grouped)) {
			result[name] = children.length === 1 ? children[0] : children;
		}

		return result;
	};

	const root = doc.documentElement;
	return { [root.localName]: convertNode(root) } as never;
}

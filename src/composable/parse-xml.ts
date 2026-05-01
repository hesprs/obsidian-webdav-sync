export default function parseXML(xml: string): never {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'application/xml');

	// Handle parse errors
	const errorNode = doc.querySelector('parsererror');
	if (errorNode) throw new Error(`XML Parse Error: ${errorNode.textContent?.trim()}`);

	const convertNode = (node: Node): unknown => {
		if (node.nodeType !== Node.ELEMENT_NODE) return;

		const elem = node as Element;
		const result: Record<string, unknown> = {};
		let textContent = '';
		const elementChildren: Array<Element> = [];

		for (const { localName, value } of elem.attributes) result[localName] = value;

		// Collect text and child elements
		for (const child of elem.childNodes)
			if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE)
				textContent += child.nodeValue || '';
			else if (child.nodeType === Node.ELEMENT_NODE) elementChildren.push(child as Element);

		textContent = textContent.trim();

		// Group children by tag name
		const grouped: Record<string, Array<unknown>> = {};
		for (const child of elementChildren) {
			const name = child.localName; // RemoveNSPrefix: true
			if (!grouped[name]) grouped[name] = [];
			grouped[name].push(convertNode(child));
		}

		const hasAttributes = elem.attributes.length > 0;
		const hasChildren = Object.keys(grouped).length > 0;
		if (!hasAttributes && !hasChildren && textContent) return textContent;
		if (textContent) result['#text'] = textContent;
		for (const [name, children] of Object.entries(grouped))
			result[name] = children.length === 1 ? children[0] : children;

		return result;
	};

	const root = doc.documentElement;
	return { [root.localName]: convertNode(root) } as never;
}

import {
	NodeApiError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
	type INodePropertyRouting,
	type JsonObject,
	type PostReceiveAction,
} from 'n8n-workflow';

/** graphPath is where AlphOne answers graph operations. */
const graphPath = '/api/graphql';

type GraphAnswer = { data?: IDataObject; errors?: { message: string }[] };

/** Reports whether a value is a plain object. */
function isRecord(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns one camelCase name as snake_case. */
function snakeCase(name: string): string {
	return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Returns the value with every key rewritten from camelCase to snake_case. */
function snakeKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(snakeKeys);
	}
	if (!isRecord(value)) {
		return value;
	}
	const renamed = Object.entries(value).map(([key, nested]) => [snakeCase(key), snakeKeys(nested)]);
	return Object.fromEntries(renamed);
}

/** Returns the value a dotted path names inside a record. */
function valueAt(source: IDataObject | undefined, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), source);
}

/** Returns the items one answered value stands for. */
function itemsOf(value: unknown): INodeExecutionData[] {
	const records = Array.isArray(value) ? value : [value];
	return records.map((record) => ({ json: snakeKeys(record) as IDataObject }));
}

/** Returns the object without the entries holding a blank string. */
function withoutBlanks(source: IDataObject): IDataObject {
	const kept: IDataObject = {};
	for (const [key, value] of Object.entries(source)) {
		if (value === '') {
			continue;
		}
		kept[key] = isRecord(value) ? withoutBlanks(value) : value;
	}
	return kept;
}

/** Removes the blank variables from a request, leaving their fields unset. */
async function dropBlankVariables(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body = requestOptions.body as { variables?: IDataObject } | undefined;
	if (isRecord(body?.variables)) {
		body.variables = withoutBlanks(body.variables);
	}
	return requestOptions;
}

/** Fails the operation with the first error the graph reported. */
async function failOnGraphErrors(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const [first] = (response.body as GraphAnswer).errors ?? [];
	if (first) {
		throw new NodeApiError(this.getNode(), response.body as JsonObject, { message: first.message });
	}
	return items;
}

/** Returns the action reading one dotted path of the answered data into items. */
function readValue(path: string): PostReceiveAction {
	return async function readAnswered(
		this: IExecuteSingleFunctions,
		_items: INodeExecutionData[],
		response: IN8nHttpFullResponse,
	): Promise<INodeExecutionData[]> {
		const value = valueAt((response.body as GraphAnswer).data, path);
		if (value === null || value === undefined) {
			throw new NodeApiError(this.getNode(), response.body as JsonObject, {
				message: 'AlphOne holds no record under that id',
			});
		}
		return itemsOf(value);
	};
}

/** Replaces every edge item with the node it carries. */
async function unwrapNodes(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	return items.map((item) => ({ json: item.json.node as IDataObject }));
}

/** Returns the routing that posts one document and handles its answer. */
function graphRouting(document: string, postReceive: PostReceiveAction[]): INodePropertyRouting {
	return {
		request: { method: 'POST', url: graphPath, body: { query: document } },
		send: { preSend: [dropBlankVariables] },
		output: { postReceive },
	};
}

/** Returns the routing reading one dotted path of a document's answer. */
export function graphItems(document: string, path: string): INodePropertyRouting {
	return graphRouting(document, [failOnGraphErrors, readValue(path)]);
}

/** Returns the routing reading one connection of a document's answer. */
export function graphPage(document: string, field: string): INodePropertyRouting {
	return graphRouting(document, [failOnGraphErrors, readValue(`${field}.edges`), unwrapNodes]);
}

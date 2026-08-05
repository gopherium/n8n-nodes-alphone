import { describe, expect, it } from 'vitest';
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { AlphOne } from './AlphOne.node';
import { AlphOneTrigger } from '../AlphOneTrigger/AlphOneTrigger.node';
import importToDailyTasks from '../../examples/import-to-daily-tasks.json';
import overdueTaskDigest from '../../examples/overdue-task-digest.json';
import whatsappMessageToTask from '../../examples/whatsapp-message-to-task.json';

type WorkflowNode = { name: string; type: string; parameters: Record<string, unknown> };
type Workflow = { nodes: WorkflowNode[] };
type Usage = { where: string; resource: string; operation: string; parameter: string; nested: boolean };

const properties = new AlphOne().description.properties;

/** Returns every shipped example workflow with the file it came from. */
function examples(): { file: string; workflow: Workflow }[] {
	return [
		{ file: 'import-to-daily-tasks.json', workflow: importToDailyTasks as Workflow },
		{ file: 'overdue-task-digest.json', workflow: overdueTaskDigest as Workflow },
		{ file: 'whatsapp-message-to-task.json', workflow: whatsappMessageToTask as Workflow },
	];
}

/** Returns the nodes of one workflow that carry a type. */
function nodesOfType(workflow: Workflow, type: string): WorkflowNode[] {
	return workflow.nodes.filter((node) => node.type === type);
}

/** Returns whether a display rule admits a value, an absent rule admitting every value. */
function admits(rule: unknown, value: string): boolean {
	return !Array.isArray(rule) || rule.includes(value);
}

/** Returns whether a property is visible for one resource and operation. */
function visible(property: INodeProperties, resource: string, operation: string): boolean {
	const show = property.displayOptions?.show;
	return admits(show?.resource, resource) && admits(show?.operation, operation);
}

/** Returns the parameter names the node accepts for one resource and operation. */
function accepted(resource: string, operation: string): string[] {
	return properties.filter((property) => visible(property, resource, operation)).map((property) => property.name);
}

/** Returns the field names an Additional Fields collection offers. */
function collected(resource: string, operation: string): string[] {
	const collection = properties.find(
		(property) => property.name === 'additionalFields' && visible(property, resource, operation),
	);
	return (collection?.options ?? []).map((option) => ('name' in option ? option.name : ''));
}

/** Returns every parameter one example sets on an AlphOne node. */
function usages(file: string, workflow: Workflow): Usage[] {
	return nodesOfType(workflow, 'n8n-nodes-alphone.alphOne').flatMap((node) => {
		const shared = {
			where: `${file}: ${node.name}`,
			resource: String(node.parameters.resource ?? ''),
			operation: String(node.parameters.operation ?? ''),
		};
		const extra = Object.keys((node.parameters.additionalFields ?? {}) as object);
		return [
			...Object.keys(node.parameters).map((parameter) => ({ ...shared, parameter, nested: false })),
			...extra.map((parameter) => ({ ...shared, parameter, nested: true })),
		];
	});
}

/** Returns whether the node declares the parameter one usage sets. */
function declares(use: Usage): boolean {
	const names = use.nested
		? collected(use.resource, use.operation)
		: accepted(use.resource, use.operation);
	return names.includes(use.parameter);
}

/** Returns the operation values a resource offers. */
function operationsOf(resource: string): string[] {
	const operations = properties.find(
		(property) => property.name === 'operation' && visible(property, resource, ''),
	);
	return ((operations?.options ?? []) as INodePropertyOptions[]).map((option) => String(option.value));
}

/** Returns the example node parameters keyed by node name. */
function parametersOf(workflow: Workflow, name: string): Record<string, unknown> {
	return workflow.nodes.find((node) => node.name === name)?.parameters ?? {};
}

describe('the shipped example workflows', () => {
	it('all carry nodes, so the checks below are not vacuous', () => {
		const empty = examples()
			.filter(({ workflow }) => (workflow.nodes ?? []).length === 0)
			.map(({ file }) => file);

		expect(empty).toEqual([]);
	});

	it('name an operation their resource offers', () => {
		const unknown = examples().flatMap(({ file, workflow }) =>
			nodesOfType(workflow, 'n8n-nodes-alphone.alphOne')
				.filter((node) => !operationsOf(String(node.parameters.resource ?? '')).includes(String(node.parameters.operation ?? '')))
				.map((node) => `${file}: ${node.name}`),
		);

		expect(unknown).toEqual([]);
	});

	it('set only parameters the node declares', () => {
		const unknown = examples().flatMap(({ file, workflow }) =>
			usages(file, workflow)
				.filter((use) => !declares(use))
				.map((use) => `${use.where} sets ${use.parameter}`),
		);

		expect(unknown).toEqual([]);
	});

	it('subscribe to events the trigger offers', () => {
		const offered = (new AlphOneTrigger().description.properties.find(
			(property) => property.name === 'events',
		)?.options ?? []) as INodePropertyOptions[];
		const values = offered.map((option) => String(option.value));
		const unknown = examples().flatMap(({ file, workflow }) =>
			nodesOfType(workflow, 'n8n-nodes-alphone.alphOneTrigger')
				.flatMap((node) => (node.parameters.events ?? []) as string[])
				.filter((event) => !values.includes(event))
				.map((event) => `${file}: ${event}`),
		);

		expect(unknown).toEqual([]);
	});
});

describe('the import to daily tasks example', () => {
	const workflow = examples().find(({ file }) => file === 'import-to-daily-tasks.json')?.workflow;

	it('spreads the contacts over days in batches of twenty', () => {
		expect(parametersOf(workflow!, 'Batch of twenty').batchSize).toBe(20);
	});

	it('dates each batch a day later than the one before', () => {
		expect(parametersOf(workflow!, 'Create the call task').dueOn).toContain('$runIndex');
	});

	it('carries the import row id so a replay creates no second task', () => {
		const additional = parametersOf(workflow!, 'Create the call task').additionalFields;

		expect(additional).toEqual({
			contact_id: '={{ $json.contact_id }}',
			origin_event_id: '={{ $json.row_id }}',
		});
	});
});

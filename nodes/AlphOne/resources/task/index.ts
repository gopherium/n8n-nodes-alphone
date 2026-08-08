import type { INodeProperties } from 'n8n-workflow';
import { graphItems, graphPage } from '../../graph';
import { createDescription } from './create';
import { getAllDescription } from './getAll';
import { updateDescription } from './update';

/** taskFields is the task shape every task operation answers with. */
const taskFields = `
	id
	assigneeId
	contactId
	title
	status
	priority
	dueOn
	originSource
	originEventId
	createdAt
`;

const tasksDocument = `
	query NodeTasks($date: Date, $dueBefore: Date, $contactId: UUID, $status: String, $first: Int) {
		tasks(date: $date, dueBefore: $dueBefore, contactId: $contactId, status: $status, first: $first) {
			edges { node { ${taskFields} } }
		}
	}
`;

const taskDocument = `
	query NodeTask($id: UUID!) {
		task(id: $id) { ${taskFields} }
	}
`;

const createTaskDocument = `
	mutation NodeCreateTask($title: String!, $dueOn: Date!, $priority: Int, $contactId: UUID, $originEventId: UUID) {
		createTask(
			input: {
				title: $title
				dueOn: $dueOn
				priority: $priority
				contactId: $contactId
				originEventId: $originEventId
			}
		) {
			task { ${taskFields} }
		}
	}
`;

const updateTaskDocument = `
	mutation NodeUpdateTask($id: UUID!, $title: String, $dueOn: Date, $status: String, $priority: Int) {
		updateTask(
			id: $id
			input: { title: $title, dueOn: $dueOn, status: $status, priority: $priority }
		) {
			${taskFields}
		}
	}
`;

const completeTaskDocument = `
	mutation NodeCompleteTask($id: UUID!) {
		updateTask(id: $id, input: { status: "done" }) { ${taskFields} }
	}
`;

const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'create',
		displayOptions: { show: { resource: ['task'] } },
		options: [
			{
				name: 'Complete',
				value: 'complete',
				action: 'Complete a task',
				description: 'Move a task into done',
				routing: graphItems(completeTaskDocument, 'updateTask'),
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a task',
				routing: graphItems(createTaskDocument, 'createTask.task'),
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a task',
				routing: graphItems(taskDocument, 'task'),
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many tasks',
				routing: graphPage(tasksDocument, 'tasks'),
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a task',
				routing: graphItems(updateTaskDocument, 'updateTask'),
			},
		],
	},
];

export const taskDescription: INodeProperties[] = [
	...operations,
	...createDescription,
	...getAllDescription,
	...updateDescription,
];

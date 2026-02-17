export type WorkflowStatus = {
    name: string;
    assignee?: {
        type?: string;
        selection?: string;
        user_ids?: string[];
        field_code?: string;
        entities?: {
            entity_type: string;
            entity_id: string;
        }[];
    };
};

export type WorkflowAction = {
    name: string;
    from?: string;
    from_status?: string;
    to?: string;
    to_status?: string;
};

export type ProcessManagement = {
    enabled?: boolean;
    statuses?: WorkflowStatus[];
    actions?: WorkflowAction[];
};

type RecordLike = {
    status: string;
    created_by?: string;
    data?: Record<string, unknown>;
};

export const getAvailableWorkflowActions = (
    processManagement: ProcessManagement | undefined,
    currentStatus: string
) => {
    if (!processManagement?.enabled) return [];

    const actions = processManagement.actions || [];
    return actions.filter((action) => {
        const fromStatus = action.from || action.from_status;
        return fromStatus === currentStatus;
    });
};

export const resolveNextAssigneeCandidates = (
    processManagement: ProcessManagement | undefined,
    action: WorkflowAction,
    record: RecordLike
) => {
    const statuses = processManagement?.statuses || [];
    const toStatus = action.to || action.to_status;
    if (!toStatus) return [];

    const statusConfig = statuses.find((status) => status.name === toStatus);
    if (!statusConfig?.assignee) return [];

    const assignee = statusConfig.assignee;
    if (assignee.type === "creator") {
        return record.created_by ? [record.created_by] : [];
    }

    if (assignee.type === "users") {
        return assignee.user_ids || [];
    }

    if (assignee.type === "field" && assignee.field_code) {
        const value = record.data?.[assignee.field_code];
        if (Array.isArray(value)) return value.map(String);
        return value ? [String(value)] : [];
    }

    return [];
};

export const requiresSingleSelection = (
    processManagement: ProcessManagement | undefined,
    action: WorkflowAction
) => {
    const statuses = processManagement?.statuses || [];
    const toStatus = action.to || action.to_status;
    if (!toStatus) return false;

    const statusConfig = statuses.find((status) => status.name === toStatus);
    return statusConfig?.assignee?.selection === "single";
};

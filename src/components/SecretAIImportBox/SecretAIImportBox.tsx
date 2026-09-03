// app/components/SecretAIImportBox/SecretAIImportBox.tsx
//
// Reusable AI-assisted import component for structured application forms.
//
// IMPORTANT:
// This component does NOT know anything about the database schema.
// It receives a description of the FORM it is attached to through the
// `formSchema` prop.
//
// Every implementation of SecretAIImportBox must provide a formSchema that
// describes only the fields that AI is allowed to populate in that form.
//
// The formSchema may describe:
// - strings
// - numbers
// - booleans
// - enums
// - arrays
// - nested objects
// - arrays of structured objects
//
// Example implementation:
//
// <SecretAIImportBox
//   formSchema={{
//     name: "IdeaPad Idea",
//     fields: {
//       title: {
//         type: "string",
//         required: true,
//         description: "Short descriptive title for the idea",
//       },
//
//       category: {
//         type: "enum",
//         required: true,
//         values: ["admin_panel", "website", "ordering"],
//       },
//
//       priority: {
//         type: "number",
//         required: true,
//         values: [1, 2, 3, 4, 5],
//       },
//
//       is_travel_friendly: {
//         type: "boolean",
//       },
//
//       tasks: {
//         type: "array",
//         description: "Tasks required to complete the idea",
//         items: {
//           type: "object",
//           fields: {
//             title: {
//               type: "string",
//               required: true,
//               description: "Task description",
//             },
//             completed: {
//               type: "boolean",
//               required: true,
//             },
//           },
//         },
//       },
//
//       notes: {
//         type: "string",
//       },
//     },
//   }}
//   onImport={(values) => {
//     // Populate the existing form/editor state here.
//     // SecretAIImportBox never saves directly to the database.
//   }}
// />
//
// The formSchema serves two purposes:
//
// 1. Generate the instructions copied to ChatGPT.
// 2. Validate the JSON pasted back into the import box.
//
// The schema describes the FORM, not the database.
//
// Database-only fields such as:
// - id
// - created_at
// - updated_at
// - completed_at
// - foreign keys
// - generated identifiers
// - other persistence-only fields
//
// should NOT be included unless they are genuinely editable fields in the
// attached form.
//
// Example:
// IdeaPad tasks contain an internal `id`, but the user does not type that ID
// into the form. Therefore the AI task schema should contain only:
//
// {
//   title: string,
//   completed: boolean
// }
//
// The parent IdeaPad editor is responsible for creating task IDs when imported
// task values are converted into the editor's normal form state.
//
// SecretAIImportBox must never write directly to the database.
//
// After a successful import it returns validated values to the parent editor.
// The parent editor then populates its existing form state. The user can review
// or edit those values and save through the editor's normal save process.
//
// SecretAIImportBox should never simulate UI actions such as clicking "+ Task"
// multiple times. If imported JSON contains an array of tasks, ingredients,
// courses, menu items, or other repeating form data, the parent editor should
// receive that array directly and render the appropriate number of form rows
// from its normal state.
//
// When adding SecretAIImportBox to another form:
//
// 1. Define that form's importable fields.
// 2. Pass those fields through `formSchema`.
// 3. Exclude database-only or application-generated fields.
// 4. Provide `onImport` to convert validated imported values into the existing
//    editor state.
// 5. Generate any application-owned values such as IDs inside the parent
//    editor.
// 6. Do not add form-specific logic to SecretAIImportBox itself.

"use client";

import { useMemo, useState } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type SecretAIPrimitive = string | number | boolean;

type SecretAIBaseField = {
    required?: boolean;
    description?: string;
};

export type SecretAIStringField = SecretAIBaseField & {
    type: "string";
};

export type SecretAINumberField = SecretAIBaseField & {
    type: "number";
    values?: number[];
};

export type SecretAIBooleanField = SecretAIBaseField & {
    type: "boolean";
};

export type SecretAIEnumField = SecretAIBaseField & {
    type: "enum";
    values: SecretAIPrimitive[];
};

export type SecretAIObjectField = SecretAIBaseField & {
    type: "object";
    fields: Record<string, SecretAIFormField>;
};

export type SecretAIArrayField = SecretAIBaseField & {
    type: "array";
    items: SecretAIFormField;
};

export type SecretAIFormField =
    | SecretAIStringField
    | SecretAINumberField
    | SecretAIBooleanField
    | SecretAIEnumField
    | SecretAIObjectField
    | SecretAIArrayField;

export type SecretAIFormSchema = {
    name: string;
    description?: string;
    fields: Record<string, SecretAIFormField>;
};

type SecretAIImportBoxProps = {
    formSchema: SecretAIFormSchema;
    currentValues: Record<string, unknown>;
    onImport: (values: Record<string, unknown>) => void | Promise<void>;
    successMessage?: string;
    closeAfterImport?: boolean;
    disabled?: boolean;
};

// -----------------------------------------------------------------------------
// Instruction Helpers
// -----------------------------------------------------------------------------

function getFieldTypeLabel(field: SecretAIFormField): string {
    switch (field.type) {
        case "string":
            return "string";

        case "number":
            return "number";

        case "boolean":
            return "boolean";

        case "enum":
            return "enum";

        case "object":
            return "object";

        case "array":
            return "array";
    }
}

function extractFormValues(
    value: unknown,
    fields: Record<string, SecretAIFormField>,
): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [fieldName, field] of Object.entries(fields)) {
        const fieldValue = source[fieldName];

        if (fieldValue === undefined) {
            continue;
        }

        result[fieldName] = extractFieldValue(fieldValue, field);
    }

    return result;
}

function extractFieldValue(
    value: unknown,
    field: SecretAIFormField,
): unknown {
    if (value === null) {
        return null;
    }

    switch (field.type) {
        case "string":
        case "number":
        case "boolean":
        case "enum":
            return value;

        case "object":
            return extractFormValues(value, field.fields);

        case "array":
            if (!Array.isArray(value)) {
                return value;
            }

            return value.map((item) => extractFieldValue(item, field.items));
    }
}

function buildFieldInstructions(
    fieldName: string,
    field: SecretAIFormField,
    indentLevel = 0,
): string {
    const indent = "  ".repeat(indentLevel);
    const childIndent = "  ".repeat(indentLevel + 1);

    const lines = [
        `${indent}${fieldName}:`,
        `${childIndent}- Type: ${getFieldTypeLabel(field)}`,
        `${childIndent}- Required: ${field.required ? "yes" : "no"}`,
    ];

    if (field.description) {
        lines.push(`${childIndent}- Description: ${field.description}`);
    }

    if (field.type === "enum") {
        lines.push(
            `${childIndent}- Allowed values: ${field.values
                .map((value) => JSON.stringify(value))
                .join(", ")}`,
        );
    }

    if (field.type === "number" && field.values?.length) {
        lines.push(
            `${childIndent}- Allowed values: ${field.values.join(", ")}`,
        );
    }

    if (field.type === "object") {
        lines.push(`${childIndent}- Fields:`);

        for (const [childName, childField] of Object.entries(field.fields)) {
            lines.push(
                buildFieldInstructions(childName, childField, indentLevel + 2),
            );
        }
    }

    if (field.type === "array") {
        lines.push(`${childIndent}- Array item schema:`);

        lines.push(
            buildFieldInstructions("item", field.items, indentLevel + 2),
        );
    }

    return lines.join("\n");
}

export function buildAIInstructions(
    formSchema: SecretAIFormSchema,
    currentValues: Record<string, unknown>,
): string {
    const fieldInstructions = Object.entries(formSchema.fields)
        .map(([fieldName, field]) =>
            buildFieldInstructions(fieldName, field),
        )
        .join("\n\n");

    const formValues = extractFormValues(
        currentValues,
        formSchema.fields,
    );

    return [
        `Create or edit structured data for the following form: ${formSchema.name}`,
        formSchema.description ?? "",
        "",
        "The CURRENT FORM VALUES are included below.",
        "",
        "If the current values contain meaningful existing information, treat them as the starting point for editing.",
        "Preserve existing information unless the user specifically asks to change, replace, or remove it.",
        "",
        "If the current values are blank or contain only normal default values, treat this as a new record.",
        "",
        "When finished, return the COMPLETE updated object.",
        "Include unchanged values that should remain in the form.",
        "",
        "Return ONLY one valid JSON code block.",
        "Do not include explanations before or after the JSON.",
        "Use only the fields defined in the FORM SCHEMA.",
        "Do not invent additional fields.",
        "Respect all required fields and allowed values.",
        "",
        "FORM SCHEMA",
        "",
        fieldInstructions,
        "",
        "CURRENT FORM VALUES",
        "",
        JSON.stringify(formValues, null, 2),
    ]
        .filter((line) => line !== "")
        .join("\n");
}

// -----------------------------------------------------------------------------
// Validation Helpers
// -----------------------------------------------------------------------------

function validateObjectFields(
    value: unknown,
    fields: Record<string, SecretAIFormField>,
    path: string,
): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${path} must be an object.`);
    }

    const imported = value as Record<string, unknown>;
    const validated: Record<string, unknown> = {};

    for (const key of Object.keys(imported)) {
        if (!(key in fields)) {
            throw new Error(`Unknown field: "${path}.${key}".`);
        }
    }

    for (const [fieldName, field] of Object.entries(fields)) {
        const fieldPath = `${path}.${fieldName}`;
        const fieldValue = imported[fieldName];

        if (fieldValue === undefined || fieldValue === null) {
            if (field.required) {
                throw new Error(`Missing required field: "${fieldPath}".`);
            }

            continue;
        }

        validated[fieldName] = validateFieldValue(
            fieldValue,
            field,
            fieldPath,
        );
    }

    return validated;
}

function validateFieldValue(
    value: unknown,
    field: SecretAIFormField,
    path: string,
): unknown {
    switch (field.type) {
        case "string": {
            if (typeof value !== "string") {
                throw new Error(`"${path}" must be a string.`);
            }

            return value;
        }

        case "number": {
            if (typeof value !== "number" || Number.isNaN(value)) {
                throw new Error(`"${path}" must be a number.`);
            }

            if (field.values?.length && !field.values.includes(value)) {
                throw new Error(
                    `"${path}" must be one of: ${field.values.join(", ")}.`,
                );
            }

            return value;
        }

        case "boolean": {
            if (typeof value !== "boolean") {
                throw new Error(`"${path}" must be true or false.`);
            }

            return value;
        }

        case "enum": {
            if (!field.values.some((allowedValue) => allowedValue === value)) {
                throw new Error(
                    `"${path}" must be one of: ${field.values
                        .map(String)
                        .join(", ")}.`,
                );
            }

            return value;
        }

        case "object": {
            return validateObjectFields(value, field.fields, path);
        }

        case "array": {
            if (!Array.isArray(value)) {
                throw new Error(`"${path}" must be an array.`);
            }

            return value.map((item, index) =>
                validateFieldValue(
                    item,
                    field.items,
                    `${path}[${index}]`,
                ),
            );
        }
    }
}

export function validateImportedValues(
    value: unknown,
    formSchema: SecretAIFormSchema,
): Record<string, unknown> {
    return validateObjectFields(
        value,
        formSchema.fields,
        formSchema.name,
    );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SecretAIImportBox({
    formSchema,
    currentValues,
    onImport,
    successMessage = "Import successful.",
    closeAfterImport = false,
    disabled = false,
}: SecretAIImportBoxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [jsonText, setJsonText] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    const aiInstructions = useMemo(
        () => buildAIInstructions(formSchema, currentValues),
        [formSchema, currentValues],
    );

    async function handleCopyInstructions() {
        try {
            await navigator.clipboard.writeText(aiInstructions);

            setHasError(false);
            setMessage("AI instructions copied.");
        } catch {
            setHasError(true);
            setMessage("Could not copy AI instructions.");
        }
    }

    async function handleImport() {
        try {
            const parsed = JSON.parse(jsonText) as unknown;

            const validated = validateImportedValues(
                parsed,
                formSchema,
            );

            await onImport(validated);

            setHasError(false);
            setMessage(successMessage);
            setJsonText("");
            if (closeAfterImport) {
                setIsOpen(false);
            }
        } catch (error) {
            setHasError(true);

            setMessage(
                error instanceof Error
                    ? error.message
                    : "AI gave us bad JSON. Yell at it and try again. Your form has not been changed.",
            );
        }
    }

    return (
        <>
            {!isOpen ? (
                <div className="flex min-w-0 items-center">
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        disabled={disabled}
                        title="Secret AI Import Box™"
                        className="min-h-11 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-purple-700 hover:text-purple-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        AI+
                    </button>
                </div>
            ) : (
                <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-purple-900/70 bg-purple-950/20">
                    <div className="flex flex-wrap items-center gap-2 p-3">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            disabled={disabled}
                            className="rounded-lg border border-purple-700 px-3 py-2 text-sm font-semibold text-purple-200 transition-colors hover:bg-purple-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Close AI Import
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyInstructions}
                            disabled={disabled}
                            className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Copy AI Instructions
                        </button>

                        {message &&
                            !hasError &&
                            message === "AI instructions copied." ? (
                            <span className="text-sm text-green-400">
                                {message}
                            </span>
                        ) : null}
                    </div>

                    <div className="border-t border-purple-900/70 p-3">
                        <p className="mb-2 text-sm text-gray-400">
                            Paste the JSON returned by ChatGPT. Importing only
                            populates the form; it does not save anything.
                        </p>

                        <textarea
                            value={jsonText}
                            onChange={(event) => {
                                setJsonText(event.target.value);
                                setMessage(null);
                                setHasError(false);
                            }}
                            disabled={disabled}
                            rows={10}
                            spellCheck={false}
                            className="block min-h-44 w-full max-w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-base text-gray-200 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                            placeholder={'{\n  "title": "..."\n}'}
                        />

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={disabled || jsonText.trim() === ""}
                                className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Import Into Form
                            </button>

                            {message &&
                                message !== "AI instructions copied." ? (
                                <span
                                    className={`text-sm ${hasError
                                            ? "text-red-400"
                                            : "text-green-400"
                                        }`}
                                >
                                    {message}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function hasField<T>(fields: string[], field: T): boolean {
	return fields.some((req: string) => Object.prototype.hasOwnProperty.call(field, req)
	)
}

export { hasField }

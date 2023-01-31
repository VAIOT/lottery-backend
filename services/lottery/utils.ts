/**
 * Check if object property exist in array.
 *
 * @function
 * @template T, V
 * @param {T} object - any object
 * @param {T[]<V extends T & PropertyKey>} properties - property to look for
 *
 * @returns boolean
 * */
function hasProperty<T, V extends T & PropertyKey>(object: T, properties: V[]): boolean {
	return properties.some((prop: V) => Object.prototype.hasOwnProperty.call(object, prop)
	)
}

export { hasProperty }

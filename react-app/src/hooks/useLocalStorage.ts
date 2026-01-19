import { useState, useCallback } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? { ...initialValue, ...JSON.parse(item) } : initialValue
    } catch (error) {
      console.error('Error reading localStorage:', error)
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      // 使用 setStoredValue 的函数形式确保获取最新值
      setStoredValue(prevValue => {
        const valueToStore = value instanceof Function ? value(prevValue) : value
        localStorage.setItem(key, JSON.stringify(valueToStore))
        return valueToStore
      })
    } catch (error) {
      console.error('Error writing localStorage:', error)
    }
  }, [key])

  return [storedValue, setValue]
}

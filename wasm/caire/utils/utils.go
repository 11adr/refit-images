package utils

import "golang.org/x/exp/constraints"

// Min returns the smallest of the provided values.
func Min[T constraints.Ordered](values ...T) T {
	acc := values[0]
	for _, v := range values {
		if v < acc {
			acc = v
		}
	}
	return acc
}

// Max returns the biggest of the provided values.
func Max[T constraints.Ordered](values ...T) T {
	acc := values[0]
	for _, v := range values {
		if v > acc {
			acc = v
		}
	}
	return acc
}

// Abs returns the absolute value of x.
func Abs[T constraints.Signed | constraints.Float](x T) T {
	if x < 0 {
		return -x
	}
	return x
}

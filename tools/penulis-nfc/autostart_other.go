//go:build !windows && !darwin

package main

// Other systems (Linux) build for checks only; starting with the computer is not set up there.

func autostartEnabled() bool { return false }

func setAutostart(bool) {}

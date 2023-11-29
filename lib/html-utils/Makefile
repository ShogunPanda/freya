.PHONY: all format

all:
	wasm-pack build -d target/dist -t nodejs
	rm -rf ../../dist/lib/html-utils && mkdir -p ../../dist/lib
	cp -a target/dist ../../dist/lib/html-utils
	rm -rf ../../dist/lib/html-utils/.gitignore

format:
	rustfmt src/lib.rs
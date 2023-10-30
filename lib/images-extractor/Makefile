all: target/dist
	wasm-pack build -d target/dist -t nodejs
	rm -rf ../../dist/lib/images-extractor && mkdir -p ../../dist/lib
	cp -a target/dist ../../dist/lib/images-extractor
	rm -rf ../../dist/lib/images-extractor
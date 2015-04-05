
all:
	browserify --debug -t browserify-jade index.js --outfile build/bundle.js
	cd build && uglifyjs \
		../vendor/three.js \
		../vendor/jquery.js \
		../vendor/stats.js \
		../vendor/pointer-lock-controls.js \
		../vendor/three-vrrenderer.js \
		../vendor/three-dat.js \
		../vendor/helvetiker_regular.typeface.js \
		../vendor/obj-loader.js \
		./bundle.js \
		--source-map "scenevr.min.js.map" \
		--compress "warnings=false" \
		--output scenevr.min.js 
	gzip -9 build/scenevr.min.js
	mv build/scenevr.min.js.gz build/scenevr.min.js
	lessc css/scenevr.less > css/scenevr.css
	# cp index.html build
	cp css/*.css build/css
	rm -rf build/vendor
	cp images/* build/images
	s3cmd put  --add-header='Cache-Control: public, max-age=43200' --recursive ./build/* s3://client.scenevr.com/
	s3cmd put  --add-header='Cache-Control: public, max-age=43200' --add-header='Content-Encoding: gzip' ./build/scenevr.min.js s3://client.scenevr.com/



all:
	browserify -t browserify-jade index.js > build/bundle.js
	cp index.html build
	cp css/*.css build/css
	cp vendor/* build/vendor
	cp images/* build/images
	s3cmd put  --add-header='Cache-Control: public, max-age=43200' --recursive ./build/* s3://client.scenevr.com/


build:
	docker build -t dobox-developer-partial .
	docker run --privileged -it dobox-developer-partial /scripts-cross/privileged-prep
	sh -c "docker commit -a 'Builder' $$(docker ps -l -q) dobox/dobox-developer-cross-base"

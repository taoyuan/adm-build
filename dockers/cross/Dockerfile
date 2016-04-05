FROM ubuntu:14.04.4
MAINTAINER Tao Yuan <towyuan@outlook.com>

RUN mv /etc/apt/sources.list /etc/apt/sources.list.bak && \
echo "deb http://mirrors.163.com/ubuntu/ trusty main restricted universe multiverse \n\
deb http://mirrors.163.com/ubuntu/ trusty-security main restricted universe multiverse \n\
deb http://mirrors.163.com/ubuntu/ trusty-updates main restricted universe multiverse \n\
deb http://mirrors.163.com/ubuntu/ trusty-proposed main restricted universe multiverse \n\
deb http://mirrors.163.com/ubuntu/ trusty-backports main restricted universe multiverse \n\
deb-src http://mirrors.163.com/ubuntu/ trusty main restricted universe multiverse \n\
deb-src http://mirrors.163.com/ubuntu/ trusty-security main restricted universe multiverse \n\
deb-src http://mirrors.163.com/ubuntu/ trusty-updates main restricted universe multiverse \n\
deb-src http://mirrors.163.com/ubuntu/ trusty-proposed main restricted universe multiverse \n\
deb-src http://mirrors.163.com/ubuntu/ trusty-backports main restricted universe multiverse" >> /etc/apt/sources.list

RUN apt-get update
RUN apt-get install -y nano wget curl click click-dev schroot dpkg-dev debootstrap mercurial git build-essential tesseract-ocr libleptonica-dev libtesseract-dev libudev-dev
RUN curl -sL https://deb.nodesource.com/setup_4.x | sudo bash -
RUN apt-get install -y nodejs

ADD scripts-cross /scripts-cross

ENTRYPOINT ["/scripts-cross/entry"]

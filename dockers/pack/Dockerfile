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
RUN apt-get install -y software-properties-common
RUN add-apt-repository ppa:snappy-dev/tools
RUN apt-get update
RUN apt-get install -y wget curl snappy-tools bzr git build-essential ruby-dev
RUN gem install fpm

ADD scripts /scripts

ENTRYPOINT ["/scripts/entry"]

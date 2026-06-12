ARG BUILD_FROM
FROM $BUILD_FROM

RUN apk add --no-cache python3 py3-pip \
    && pip3 install --no-cache-dir --break-system-packages flask requests

COPY run.sh /run.sh
COPY server.py /server.py
COPY www /www

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

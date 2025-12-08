# Makefile - Just makes testing docker stuff locally easier

.PHONY: build run stop clean

IMAGE_NAME := entrostat-server
CONTAINER_NAME := entrostat-server
PORT := 3001

build:
	docker build -t $(IMAGE_NAME) .

run:
	@docker rm -f $(CONTAINER_NAME) 2>/dev/null || true
	@docker run --rm -p $(PORT):$(PORT) --env-file .env --name $(CONTAINER_NAME) $(IMAGE_NAME); \

stop:
	@docker stop $(CONTAINER_NAME) 2>/dev/null || true
	@for id in $$(docker ps --filter "publish=$(PORT)" --format "{{.ID}}" 2>/dev/null); do docker stop $$id 2>/dev/null || true; done
	@for id in $$(docker ps -a --filter "publish=$(PORT)" --format "{{.ID}}" 2>/dev/null); do docker rm $$id 2>/dev/null || true; done

clean:
	@docker stop $(CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(CONTAINER_NAME) 2>/dev/null || true
	@docker rmi $(IMAGE_NAME) 2>/dev/null || true
	@for id in $$(docker ps --filter "publish=$(PORT)" --format "{{.ID}}" 2>/dev/null); do docker stop $$id 2>/dev/null || true; done
	@for id in $$(docker ps -a --filter "publish=$(PORT)" --format "{{.ID}}" 2>/dev/null); do docker rm $$id 2>/dev/null || true; done
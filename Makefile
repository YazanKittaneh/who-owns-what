.PHONY: docker-clean docker-clean-all

docker-clean:
	docker builder prune -f
	docker image prune -f

docker-clean-all:
	docker system prune -af
	docker volume prune -f

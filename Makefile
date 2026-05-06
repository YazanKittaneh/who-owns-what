.PHONY: docker-clean docker-clean-all

docker-clean:
	docker builder prune -f
	docker image prune -f

docker-clean-all:
	docker system prune -af
	docker volume prune -f

bootstrap-dev-db:
	COMPOSE_PROJECT_NAME=who-owns-what-dev ENV_FILE_PATH=/home/actions/who-owns-what-dev.env COMPOSE_FILE_PATH=/root/who-owns-what/docker-compose.prod.yml ./scripts/bootstrap_dev_db_from_latest_dump.sh

#!/bin/bash

# 🚀 Knowledge Explorer Deployment Script
# 상용화 수준의 자동화된 배포 스크립트

set -euo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 기본 설정
ENVIRONMENT=${1:-development}
PROJECT_NAME="knowledge-explorer"
COMPOSE_FILE="docker-compose.yml"

# 환경별 설정
case $ENVIRONMENT in
    "development"|"dev")
        COMPOSE_FILE="docker-compose.yml"
        ENV_FILE=".env.development"
        ;;
    "staging")
        COMPOSE_FILE="docker-compose.staging.yml"
        ENV_FILE=".env.staging"
        ;;
    "production"|"prod")
        COMPOSE_FILE="docker-compose.production.yml"
        ENV_FILE=".env.production"
        ;;
    *)
        log_error "Unknown environment: $ENVIRONMENT"
        log_info "Available environments: development, staging, production"
        exit 1
        ;;
esac

# 헬퍼 함수들
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Docker 확인
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Docker Compose 확인
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

check_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning "Environment file $ENV_FILE not found"
        if [[ -f ".env.example" ]]; then
            log_info "Copying .env.example to $ENV_FILE"
            cp .env.example "$ENV_FILE"
            log_warning "Please update $ENV_FILE with your actual configuration"
        else
            log_error "No .env.example found. Please create $ENV_FILE manually"
            exit 1
        fi
    fi
    log_success "Environment file check passed"
}

build_images() {
    log_info "Building Docker images..."
    
    if docker compose -f "$COMPOSE_FILE" build --no-cache; then
        log_success "Docker images built successfully"
    else
        log_error "Failed to build Docker images"
        exit 1
    fi
}

start_services() {
    log_info "Starting services for $ENVIRONMENT environment..."
    
    # 기존 컨테이너 정리
    docker compose -f "$COMPOSE_FILE" down
    
    # 서비스 시작
    if docker compose -f "$COMPOSE_FILE" up -d; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost/health &> /dev/null; then
            log_success "Services are ready!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts - Services not ready yet..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Services failed to become ready within expected time"
    return 1
}

run_migrations() {
    log_info "Running database migrations..."
    
    if docker compose -f "$COMPOSE_FILE" exec backend npm run migrate; then
        log_success "Database migrations completed"
    else
        log_warning "Database migrations failed or not configured"
    fi
}

show_service_status() {
    log_info "Service Status:"
    docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "Service URLs:"
    echo "  Frontend: http://localhost"
    echo "  Backend API: http://localhost:3001"
    echo "  Database: localhost:5432"
    echo "  Redis: localhost:6379"
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo "  Grafana: http://localhost:3000 (admin/admin)"
        echo "  Prometheus: http://localhost:9090"
    fi
}

# 메인 실행 함수
main() {
    log_info "🚀 Starting deployment for $ENVIRONMENT environment"
    
    # 종속성 확인
    check_dependencies
    
    # 환경 파일 확인
    check_env_file
    
    # Docker 이미지 빌드
    build_images
    
    # 서비스 시작
    start_services
    
    # 서비스 대기
    wait_for_services
    
    # 마이그레이션 실행
    run_migrations
    
    # 상태 표시
    show_service_status
    
    log_success "🎉 Deployment completed successfully!"
    log_info "Access your application at: http://localhost"
}

# 클린업 함수
cleanup() {
    log_info "Cleaning up..."
    docker compose -f "$COMPOSE_FILE" down
    log_success "Cleanup completed"
}

# 시그널 처리
trap cleanup EXIT

# 도움말 표시
show_help() {
    echo "Usage: $0 [ENVIRONMENT]"
    echo ""
    echo "ENVIRONMENT:"
    echo "  development, dev    - Development environment (default)"
    echo "  staging            - Staging environment"
    echo "  production, prod   - Production environment"
    echo ""
    echo "Examples:"
    echo "  $0                 # Deploy to development"
    echo "  $0 development     # Deploy to development"
    echo "  $0 staging         # Deploy to staging"
    echo "  $0 production      # Deploy to production"
    echo ""
    echo "Additional commands:"
    echo "  $0 help           # Show this help"
    echo "  $0 logs           # Show service logs"
    echo "  $0 stop           # Stop all services"
    echo "  $0 restart        # Restart all services"
}

# 추가 명령어 처리
case ${1:-} in
    "help"|"-h"|"--help")
        show_help
        exit 0
        ;;
    "logs")
        docker compose -f "$COMPOSE_FILE" logs -f
        exit 0
        ;;
    "stop")
        log_info "Stopping all services..."
        docker compose -f "$COMPOSE_FILE" down
        log_success "All services stopped"
        exit 0
        ;;
    "restart")
        log_info "Restarting all services..."
        docker compose -f "$COMPOSE_FILE" restart
        log_success "All services restarted"
        exit 0
        ;;
esac

# 메인 함수 실행
main

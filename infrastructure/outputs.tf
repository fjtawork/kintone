output "vpc_id" {
  value = aws_vpc.main.id
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
  description = "The DNS name of the load balancer"
}

output "db_endpoint" {
  value = aws_rds_cluster.default.endpoint
  sensitive = true
}

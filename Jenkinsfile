pipeline {
    agent { label 'faretrack-ci' }
    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 30, unit: 'MINUTES')
    }
    environment {
        TF_IN_AUTOMATION = 'true'
    }
    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                checkout scm
            }
        }
        stage('Test') {
            steps {
                sh 'npm ci'
                sh 'npm test'
            }
        }
        stage('Build Lambda') {
            steps { sh 'bash backend/scripts/buildLambda.sh' }
        }
        stage('Validate Terraform') {
            steps {
                sh 'terraform fmt -check -recursive infra'
                dir('infra/terraform') {
                    sh 'terraform init -input=false -backend=false'
                    sh 'terraform validate'
                }
                dir('infra/bootstrap') {
                    sh 'terraform init -input=false -backend=false'
                    sh 'terraform validate'
                }
            }
        }
    }
    post {
        always { deleteDir() }
    }
}
